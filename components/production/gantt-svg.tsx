"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Save, RotateCcw, AlertCircle, X } from "lucide-react";
import { Database } from "@/utils/supabase/types";
import { TaskModal } from "./task-modal";
import { updateTaskSchedule } from "@/app/dashboard/produccion/actions";
import { Button } from "@/components/ui/button";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
};

interface GanttSVGProps {
    initialMachines: Machine[];
    initialOrders: Order[];
    initialTasks: PlanningTask[];
    searchQuery: string;
    viewMode: "hour" | "day" | "week";
    isFullscreen: boolean;
    selectedMachines: Set<string>;
    operators: string[];
}

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
    initialTasks,
    searchQuery,
    viewMode,
    selectedMachines,
    operators
}: GanttSVGProps) {
    // View mode configuration
    const config = VIEW_MODE_CONFIG[viewMode];
    const UNIT_WIDTH = config.width;

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

    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [modalData, setModalData] = useState<any>(null);
    const [draggingTask, setDraggingTask] = useState<{ id: string, startX: number, initialX: number } | null>(null);
    const [resizingTask, setResizingTask] = useState<{
        id: string,
        startX: number,
        initialWidth: number,
        initialStart?: number,
        direction?: 'left' | 'right',
        dayStart?: number,
        dayEnd?: number
    } | null>(null);
    const [savedTasks, setSavedTasks] = useState<PlanningTask[]>(initialTasks);
    const [optimisticTasks, setOptimisticTasks] = useState<PlanningTask[]>(initialTasks);
    const [isSaving, setIsSaving] = useState(false);
    const [hoveredTask, setHoveredTask] = useState<PlanningTask | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number, mode: 'above' | 'below' }>({ x: 0, y: 0, mode: 'below' });
    const [currentTime, setCurrentTime] = useState<Date | null>(null); // Fix hydration mismatch
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Initialize current time on client and update every minute
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Sync changes from props (Server) to Saved state
    useEffect(() => {
        setSavedTasks(initialTasks);
        setOptimisticTasks(initialTasks);
    }, [initialTasks]);

    // Auto-scroll to today on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayX = timeToX(moment());
            // Center today in the viewport
            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollTo = Math.max(0, todayX - containerWidth / 3);
            scrollContainerRef.current.scrollLeft = scrollTo;
        }
    }, []);

    // Detect Changes
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

    // Handlers
    const handleSave = async () => {
        if (changedTasks.length === 0) return;
        setIsSaving(true);
        try {
            // Execute all updates in parallel
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
        }
    };



    // 2. Filter machines and tasks
    const filteredMachines = useMemo(() => {
        const uniqueNames = new Set([
            ...initialMachines.map(m => m.name),
            ...optimisticTasks.map(t => t.machine).filter((n): n is string => !!n)
        ]);
        if (optimisticTasks.some(t => !t.machine)) uniqueNames.add("Sin Máquina");

        return Array.from(uniqueNames)
            .filter(name => selectedMachines.has(name))
            .sort();
    }, [initialMachines, optimisticTasks, selectedMachines]);

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
        if (viewMode === 'hour') {
            const diffHours = x / UNIT_WIDTH;
            return moment(timeWindow.start).add(diffHours, "hours");
        } else if (viewMode === 'day') {
            const diffDays = x / UNIT_WIDTH;
            return moment(timeWindow.start).add(diffDays, "days");
        } else {
            const diffWeeks = x / UNIT_WIDTH;
            return moment(timeWindow.start).add(diffWeeks, "weeks");
        }
    };

    const totalWidth = useMemo(() => {
        if (viewMode === 'hour') {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60) * UNIT_WIDTH;
        } else if (viewMode === 'day') {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60 * 24) * UNIT_WIDTH;
        } else {
            return (timeWindow.end.valueOf() - timeWindow.start.valueOf()) / (1000 * 60 * 60 * 24 * 7) * UNIT_WIDTH;
        }
    }, [timeWindow, viewMode, UNIT_WIDTH]);

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

    // Expanded Color Palette for Projects (15 vibrant colors)
    const PROJECT_COLORS = [
        '#E91E63', // Pink
        '#2196F3', // Blue
        '#4CAF50', // Green
        '#FF9800', // Orange
        '#9C27B0', // Purple
        '#00BCD4', // Cyan
        '#F44336', // Red
        '#3F51B5', // Indigo
        '#009688', // Teal
        '#CDDC39', // Lime
        '#795548', // Brown
        '#607D8B', // Blue Grey
        '#FF5722', // Deep Orange
        '#673AB7', // Deep Purple
        '#8BC34A', // Light Green
    ];

    // Color Logic: meaningful and distributed
    const getProjectColor = useMemo(() => {
        const colorMap = new Map<string, string>();
        let colorIndex = 0;

        // Collect all unique project/order IDs
        const uniqueIds = new Set<string>();
        optimisticTasks.forEach(t => {
            const id = t.order_id || t.production_orders?.id || t.id;
            if (id) uniqueIds.add(id);
        });

        // Assign colors sequentially
        Array.from(uniqueIds).sort().forEach(id => {
            colorMap.set(id, PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]);
            colorIndex++;
        });

        return (task: PlanningTask) => {
            const id = task.order_id || task.production_orders?.id || task.id;
            return colorMap.get(id) || PROJECT_COLORS[0];
        };
    }, [optimisticTasks]);

    // 4. Interaction Handlers
    const handleCanvasDoubleClick = (e: React.MouseEvent) => {
        if (draggingTask) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollPos.x - SIDEBAR_WIDTH;
        const y = e.clientY - rect.top + scrollPos.y; // Removed HEADER_HEIGHT subtraction which caused offset

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

        const time = xToTime(x);

        if (foundMachine) {
            setModalData({
                machine: foundMachine,
                time: time.valueOf()
            });
        }
    };

    const onMouseDown = (e: React.MouseEvent, task: PlanningTask) => {
        e.stopPropagation();
        setDraggingTask({
            id: task.id,
            startX: e.clientX,
            initialX: timeToX(task.planned_date!)
        });
    };

    const onResizeStart = (e: React.MouseEvent, task: PlanningTask, direction: 'left' | 'right') => {
        e.stopPropagation();
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
            const newStartTime = xToTime(newX);

            setOptimisticTasks(prev => prev.map(t => {
                if (t.id === draggingTask.id) {
                    const duration = moment(t.planned_end).diff(t.planned_date);
                    return {
                        ...t,
                        planned_date: newStartTime.format("YYYY-MM-DDTHH:mm:ss"),
                        planned_end: newStartTime.clone().add(duration).format("YYYY-MM-DDTHH:mm:ss")
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

                        // CLAMP to day end
                        if (limitEnd && newEndTime.isAfter(limitEnd)) {
                            newEndTime = limitEnd.clone();
                        }

                        return { ...t, planned_end: newEndTime.format("YYYY-MM-DDTHH:mm:ss") };
                    } else {
                        // Left resize
                        // 1. Calculate ideal new X
                        let newX = (resizingTask.initialStart || 0) + Math.min(deltaX, resizingTask.initialWidth - 10);
                        let newStartDate = xToTime(newX);

                        // 2. CLAMP to day start
                        if (limitStart && newStartDate.isBefore(limitStart)) {
                            newStartDate = limitStart.clone();
                        }

                        // Re-validate against end time to ensure min width
                        const currentEnd = moment(t.planned_end);
                        if (currentEnd.diff(newStartDate, 'minutes') < 10) {
                            newStartDate = currentEnd.clone().subtract(10, 'minutes');
                        }

                        return { ...t, planned_date: newStartDate.format("YYYY-MM-DDTHH:mm:ss") };
                    }
                }
                return t;
            }));
        }
    };

    const onMouseUp = async () => {
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
    }, [timeWindow.start, timeWindow.end, viewMode]);

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
            // Day/Week view: navigate by range
            const amount = viewMode === 'day' ? 7 : 14;
            if (direction === 'today') {
                setDateRangeStart(moment().startOf('day').subtract(7, 'days'));
                setDateRangeEnd(moment().startOf('day').add(14, 'days'));
                // Scroll to current time after state update
                setTimeout(() => scrollToNow(), 100);
            } else {
                const shift = direction === 'prev' ? -amount : amount;
                setDateRangeStart(prev => moment(prev).add(shift, 'days'));
                setDateRangeEnd(prev => moment(prev).add(shift, 'days'));
            }
        }
    };

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
            {/* Date Navigation Bar */}
            <div className="flex-none h-10 border-b border-border bg-muted/30 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateDate('prev')}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigateDate('today')}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1"
                    >
                        <Calendar className="w-3 h-3" />
                        Hoy
                    </button>
                    <button
                        onClick={() => navigateDate('next')}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Siguiente"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* View-specific date display */}
                <div className="flex items-center gap-2">
                    {viewMode === 'hour' ? (
                        <input
                            type="date"
                            value={selectedDate.format('YYYY-MM-DD')}
                            onChange={(e) => setSelectedDate(moment(e.target.value))}
                            className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                        />
                    ) : (
                        <>
                            <input
                                type="date"
                                value={dateRangeStart.format('YYYY-MM-DD')}
                                onChange={(e) => setDateRangeStart(moment(e.target.value))}
                                className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                            />
                            <span className="text-xs text-foreground/40">-</span>
                            <input
                                type="date"
                                value={dateRangeEnd.format('YYYY-MM-DD')}
                                onChange={(e) => setDateRangeEnd(moment(e.target.value))}
                                className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                            />
                        </>
                    )}
                </div>
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
                            {filteredMachines.map((m, i) => (
                                <div
                                    key={i}
                                    className={`border-b border-border/10 px-4 flex items-center text-[11px] font-black uppercase tracking-tight text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0 ${i % 2 === 1 ? "bg-foreground/[0.03]" : ""}`}
                                    style={{ height: getMachineHeight(m) }}
                                >
                                    {m}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Header + Grid) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Time Header - Fixed at top, scrolls with X */}
                    <div className="h-[50px] border-b border-border bg-background/90 backdrop-blur-md flex-shrink-0 overflow-hidden relative">
                        <div
                            className="absolute top-0 left-0 h-full flex"
                            style={{
                                width: totalWidth,
                                transform: `translateX(${-scrollPos.x}px)`
                            }}
                        >
                            {timeColumns.map((col, i) => (
                                <div
                                    key={i}
                                    className={`flex flex-col justify-center items-center border-r border-border/30 text-[9px] font-black h-full transition-colors flex-shrink-0 ${col.isSpecial ? "bg-primary/10 text-primary border-primary/20" : "text-foreground/40"}`}
                                    style={{ width: UNIT_WIDTH }}
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
                        onScroll={(e) => setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
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

                                const color = getProjectColor(task);

                                return (
                                    <motion.g
                                        key={task.id}
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: activeTask ? 0.9 : 1,
                                            cursor: isDragging ? "grabbing" : "grab"
                                        }}
                                        onMouseEnter={(e) => {
                                            setHoveredTask(task);
                                            // Don't set position here, rely on mouse move
                                        }}
                                        onMouseLeave={() => setHoveredTask(null)}
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
                                    >
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            rx={6}
                                            fill={color}
                                            className="shadow-xl transition-opacity hover:opacity-100 opacity-90"
                                            style={{
                                                filter: activeTask
                                                    ? `drop-shadow(0 8px 15px ${color})`
                                                    : "drop-shadow(0 4px 6px rgba(0,0,0,0.15))",
                                                stroke: activeTask ? "white" : "rgba(255,255,255,0.2)",
                                                strokeWidth: activeTask ? 2 : 1
                                            }}
                                            onMouseDown={(e) => onMouseDown(e, task)}
                                        />
                                        {/* Interaction Shield (Underneath Resize Handle) */}
                                        <rect
                                            x={x} y={y} width={width} height={height}
                                            fill="transparent"
                                            className="cursor-pointer"
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (draggingTask || resizingTask) return;
                                                setModalData({
                                                    id: task.id,
                                                    machine: task.machine || "Sin Máquina",
                                                    start: moment(task.planned_date).format("YYYY-MM-DDTHH:mm"),
                                                    end: moment(task.planned_end).format("YYYY-MM-DDTHH:mm"),
                                                    operator: task.operator || "",
                                                    orderId: task.order_id || "",
                                                    activeOrder: task.production_orders
                                                });
                                            }}
                                        />

                                        <foreignObject x={x} y={y} width={width > 12 ? width - 12 : width} height={height} className="pointer-events-none">
                                            <div
                                                className="h-full flex flex-col justify-center text-white px-2 overflow-hidden"
                                            >
                                                <div className="text-[10px] font-black truncate uppercase leading-none drop-shadow-sm">
                                                    {task.production_orders?.part_code || "S/N"}
                                                </div>
                                                {width > 100 && (
                                                    <div className="text-[8px] font-bold opacity-90 mt-1 whitespace-nowrap bg-black/10 px-1 py-0.5 rounded-sm self-start">
                                                        {moment(task.planned_date).format("HH:mm")} - {moment(task.planned_end).format("HH:mm")}
                                                    </div>
                                                )}
                                            </div>
                                        </foreignObject>

                                        {/* Resize Handle Left */}
                                        <rect
                                            x={x}
                                            y={y}
                                            width={12}
                                            height={height}
                                            fill="transparent"
                                            className="cursor-ew-resize hover:fill-white/20 transition-colors"
                                            onMouseDown={(e) => onResizeStart(e, task, 'left')}
                                        />

                                        {/* Resize Handle Right */}
                                        <rect
                                            x={x + width - 12}
                                            y={y}
                                            width={12}
                                            height={height}
                                            fill="transparent"
                                            className="cursor-ew-resize hover:fill-white/20 transition-colors"
                                            onMouseDown={(e) => onResizeStart(e, task, 'right')}
                                        />
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
                    router.refresh();
                }}
            />

            {/* Floating Save Bar */}
            <AnimatePresence>
                {changedTasks.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-4 bg-popover/95 backdrop-blur-sm border border-border shadow-2xl p-4 rounded-xl"
                    >
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-popover-foreground">Cambios sin guardar</span>
                            <span className="text-xs text-muted-foreground">{changedTasks.length} modificaciones pendientes</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
                                Descartar <X className="w-4 h-4 ml-2" />
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                {isSaving ? "Guardando..." : "Aplicar Cambios"} <Save className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredTask && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-[9999] pointer-events-none"
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
                                    style={{ backgroundColor: getProjectColor(hoveredTask) }}
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
        </div>
    );
}
