"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, FlaskConical } from "lucide-react";
import { format, isBefore, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Database } from "@/utils/supabase/types";
import { TaskModal } from "./task-modal";
import { getProductionTaskColor } from "@/utils/production-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { snapToNearest15Minutes } from "@/lib/scheduling-utils";
import { useGanttCoordinates } from "./hooks/use-gantt-coordinates";
import {
    useGanttLayout,
    getTreatmentTypeName,
    BAR_HEIGHT,
    BAR_GAP,
    ROW_PADDING,
    BATCH_INDICATOR_HEIGHT,
} from "./hooks/use-gantt-layout";
import { useGanttDragDrop } from "./hooks/use-gantt-drag-drop";
import { GanttTaskBar } from "./gantt/GanttTaskBar";
import { GanttTooltip } from "./gantt/GanttTooltip";
import { GanttContextMenu } from "./gantt/GanttContextMenu";

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

export interface GanttSVGProps {
    initialMachines: Machine[];
    initialOrders: Order[];
    optimisticTasks: PlanningTask[];
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
    // ── Scroll ref ──────────────────────────────────────────────────────────
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ── Coordinate system ────────────────────────────────────────────────────
    const coords = useGanttCoordinates({ viewMode, zoomLevel, scrollContainerRef });
    const {
        selectedDate,
        setSelectedDate,
        dateRangeStart,
        setDateRangeStart,
        dateRangeEnd,
        setDateRangeEnd,
        timeWindow,
        UNIT_WIDTH,
        totalWidth,
        timeColumns,
        offHourRects,
        timeToX,
        xToTime,
        scrollToNow,
        navigateDate,
    } = coords;

    // ── Layout / filtering ───────────────────────────────────────────────────
    const layout = useGanttLayout({
        optimisticTasks,
        initialMachines,
        selectedMachines,
        searchQuery,
        projectFilter,
        hideEmptyMachines,
        timeWindow,
        timeToX,
    });
    const {
        taskColorMap,
        filteredMachines,
        filteredTasks,
        taskLanes,
        machineUtilizations,
        treatmentBatchGroups,
        getMachineHeight,
        machineYOffsets,
        totalHeight,
        treatmentWeekendRects,
    } = layout;

    // Dependency lines — computed here (JSX) using layout data
    const dependencyLines = useMemo(() => {
        if (!showDependencies) return [];
        const lines: React.ReactNode[] = [];
        const tasksByOrder = new Map<string, PlanningTask[]>();
        filteredTasks.forEach((task) => {
            if (task.order_id) {
                const oid = String(task.order_id);
                if (!tasksByOrder.has(oid)) tasksByOrder.set(oid, []);
                tasksByOrder.get(oid)!.push(task);
            }
        });
        tasksByOrder.forEach((groupTasks) => {
            if (groupTasks.length < 2) return;
            groupTasks.sort((a, b) => new Date(a.planned_date!).getTime() - new Date(b.planned_date!).getTime());
            for (let i = 0; i < groupTasks.length - 1; i++) {
                const startTask = groupTasks[i];
                const endTask = groupTasks[i + 1];
                const startMachine = (startTask as any).is_treatment
                    ? "TRATAMIENTO"
                    : startTask.machine || "Sin Máquina";
                const endMachine = (endTask as any).is_treatment ? "TRATAMIENTO" : endTask.machine || "Sin Máquina";
                if (!machineYOffsets.has(startMachine) || !machineYOffsets.has(endMachine)) continue;
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
                const isContinuation =
                    !!(startTask as any).register &&
                    startTask.register === endTask.register &&
                    startMachine === endMachine;
                const involvesTreatment = !!(startTask as any).is_treatment || !!(endTask as any).is_treatment;
                const lineColor = getProductionTaskColor(startTask, taskColorMap);
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
    }, [filteredTasks, machineYOffsets, taskLanes, timeToX, showDependencies, taskColorMap]);

    // ── Drag & resize ────────────────────────────────────────────────────────
    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const dragDrop = useGanttDragDrop({
        optimisticTasks,
        setOptimisticTasks,
        cascadeMode,
        readOnly,
        currentTime,
        timeToX,
        xToTime,
        onHistorySnapshot,
    });
    const { draggingTask, resizingTask, conflictingTaskIds, onMouseDown, onResizeStart, onMouseMove, onMouseUp } =
        dragDrop;

    // ── UI-local state ───────────────────────────────────────────────────────
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [localModalData, setLocalModalData] = useState<any>(null);
    const modalData = externalModalData !== undefined ? externalModalData : localModalData;
    const setModalData = externalSetModalData || setLocalModalData;
    const [hoveredTask, setHoveredTask] = useState<PlanningTask | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; mode: "above" | "below" }>({
        x: 0,
        y: 0,
        mode: "below",
    });
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: PlanningTask } | null>(null);

    // ── Scroll suppression (hides tooltip while scrolling) ───────────────────
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>(undefined);

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

    useEffect(() => {
        window.addEventListener("scroll", handleScrollInteraction, { capture: true });
        return () => window.removeEventListener("scroll", handleScrollInteraction, { capture: true });
    }, []);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // ── Auto-scroll to today on mount ─────────────────────────────────────────
    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayX = timeToX(new Date());
            const containerWidth = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollLeft = Math.max(0, todayX - containerWidth / 3);
        }
    }, [viewMode, scrollContainerRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Scroll to focused task ────────────────────────────────────────────────
    useEffect(() => {
        if (!focusTaskId || !scrollContainerRef.current) return;
        const task = optimisticTasks.find((t) => t.id === focusTaskId);
        if (!task || !task.planned_date) return;

        const x = timeToX(task.planned_date);
        const machine = (task as any).is_treatment ? "TRATAMIENTO" : task.machine || "Sin Máquina";
        const yOffset = machineYOffsets.get(machine) || 0;
        const lane = taskLanes.get(task.id) || 0;
        const y = yOffset + lane * 40 + 10;

        scrollContainerRef.current.scrollTo({
            left: Math.max(0, x - scrollContainerRef.current.clientWidth / 3),
            top: Math.max(0, y - scrollContainerRef.current.clientHeight / 2),
            behavior: "smooth",
        });
    }, [focusTaskId, optimisticTasks, timeToX, machineYOffsets, taskLanes]);

    // ── Canvas double-click → create task ────────────────────────────────────
    const handleCanvasDoubleClick = (e: React.MouseEvent) => {
        if (readOnly || draggingTask) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollPos.x;
        const y = e.clientY - rect.top + scrollPos.y;

        let foundMachine: string | null = null;
        let currentY = 0;
        for (const m of filteredMachines) {
            const h = getMachineHeight(m);
            if (y >= currentY && y < currentY + h) {
                foundMachine = m;
                break;
            }
            currentY += h;
        }

        if (!foundMachine) return;

        const snappedTime = snapToNearest15Minutes(xToTime(x));

        if (foundMachine === "TRATAMIENTO") {
            const day = getDay(snappedTime);
            if (day === 0 || day === 6) return;
        }

        setModalData({ machine: foundMachine, time: snappedTime.valueOf() });
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getTaskColor = (task: PlanningTask) => getProductionTaskColor(task, taskColorMap);

    const getUtilBadgeColor = (utilization: number) => {
        if (utilization > 85) return "bg-green-500/20 text-green-600";
        if (utilization > 50) return "bg-blue-500/20 text-blue-600";
        if (utilization > 0) return "bg-gray-500/20 text-gray-600";
        return "bg-muted text-muted-foreground";
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="relative flex flex-1 select-none flex-col overflow-hidden bg-background">
            {/* ── Gantt Header Bar ──────────────────────────────────────────── */}
            <div className="z-[50] flex h-10 flex-none items-center gap-2 border-b border-border bg-muted/30 px-4">
                {startControls}

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

                <div className="flex-1" />
                {endControls}
            </div>

            <div className="relative flex flex-1 overflow-hidden">
                {/* ── Machine Sidebar ──────────────────────────────────────── */}
                <div className="z-[40] flex w-[200px] flex-shrink-0 flex-col border-r border-border bg-background shadow-2xl transition-colors dark:bg-[#0a0a0a]">
                    <div className="flex h-[50px] flex-shrink-0 items-center border-b border-border bg-muted/30 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">
                        Máquinas
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="flex flex-col" style={{ transform: `translateY(${-scrollPos.y}px)` }}>
                            {filteredMachines.map((m, i) => {
                                const isTreatmentRow = m === "TRATAMIENTO";
                                const utilization = machineUtilizations.get(m) || 0;
                                const badgeColor = getUtilBadgeColor(utilization);
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

                {/* ── Main content area ─────────────────────────────────────── */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Time Header */}
                    <div className="relative h-[50px] flex-shrink-0 overflow-hidden border-b border-border bg-background/90 backdrop-blur-md">
                        <div
                            className="absolute left-0 top-0 h-full"
                            style={{ width: totalWidth, transform: `translateX(${-scrollPos.x}px)` }}
                        >
                            {timeColumns.map((col, i) => (
                                <div
                                    key={i}
                                    className={`flex h-full flex-col items-center justify-center border-r border-border/30 text-[9px] font-black transition-colors ${col.isSpecial ? "border-primary/20 bg-primary/10 text-primary" : col.isOffHour ? "bg-foreground/[0.04] text-foreground/20" : "text-foreground/40"}`}
                                    style={{ width: UNIT_WIDTH, position: "absolute", left: col.x, top: 0 }}
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

                    {/* SVG Canvas */}
                    <div
                        ref={scrollContainerRef}
                        className="relative flex-1 overflow-auto bg-background/5 dark:bg-[#050505]"
                        onScroll={(e) => {
                            setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop });
                            handleScrollInteraction();
                        }}
                        onWheel={handleScrollInteraction}
                        onDoubleClick={handleCanvasDoubleClick}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        {/* Screen reader live region — announces filter results without visual change */}
                        <div aria-live="polite" aria-atomic="true" className="sr-only">
                            {searchQuery
                                ? `${filteredTasks.length} tarea${filteredTasks.length !== 1 ? "s" : ""} encontrada${filteredTasks.length !== 1 ? "s" : ""} para "${searchQuery}"`
                                : `${filteredTasks.length} tarea${filteredTasks.length !== 1 ? "s" : ""}, ${filteredMachines.length} máquina${filteredMachines.length !== 1 ? "s" : ""}`}
                        </div>

                        <svg
                            width={totalWidth}
                            height={totalHeight}
                            style={{ display: "block" }}
                            role="img"
                            aria-labelledby="gantt-svg-title"
                        >
                            <title id="gantt-svg-title">
                                {`Planificador de producción — vista ${viewMode}. ${filteredMachines.length} máquina${filteredMachines.length !== 1 ? "s" : ""}, ${filteredTasks.length} tarea${filteredTasks.length !== 1 ? "s" : ""} programada${filteredTasks.length !== 1 ? "s" : ""}.`}
                            </title>
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

                            {/* Vertical grid lines */}
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

                            {/* Alternating machine row backgrounds */}
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

                            {/* Off-hours shading (hour view) */}
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

                            {/* Treatment weekend shading */}
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

                            {/* Treatment batch indicators */}
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
                                            <rect
                                                x={bx}
                                                y={treatY}
                                                width={bw}
                                                height={rowH - BATCH_INDICATOR_HEIGHT}
                                                fill="#6366f1"
                                                fillOpacity={0.05}
                                            />
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

                            {/* Dependency lines */}
                            {dependencyLines}

                            {/* Task bars */}
                            {filteredTasks.map((task) => {
                                const isTreatmentTask = !!(task as any).is_treatment;
                                const machine = isTreatmentTask ? "TRATAMIENTO" : task.machine || "Sin Máquina";
                                const machineY = machineYOffsets.get(machine) || 0;
                                const lane = taskLanes.get(task.id) || 0;

                                const x = timeToX(task.planned_date!);
                                const width = Math.max(timeToX(task.planned_end!) - x, 0);
                                const y = machineY + ROW_PADDING + lane * (BAR_HEIGHT + BAR_GAP);

                                const isDragging = draggingTask?.id === task.id;
                                const isResizing = resizingTask?.id === task.id;
                                const isFinishedOrRunning =
                                    !!task.check_in ||
                                    !!task.check_out ||
                                    isBefore(new Date(task.planned_date!), currentTime);
                                const isLocked =
                                    (isTreatmentTask && !task.isDraft) ||
                                    (!task.isDraft &&
                                        (task.locked === true || (task.locked !== false && isFinishedOrRunning)));
                                const isCascadeGhost = !!draggingTask?.cascadeIds?.includes(task.id);
                                const isConflicting = conflictingTaskIds.has(task.id);
                                const color = isConflicting ? "#ef4444" : getTaskColor(task);
                                const isFocused = focusTaskId === task.id;

                                return (
                                    <GanttTaskBar
                                        key={task.id}
                                        task={task}
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={BAR_HEIGHT}
                                        color={color}
                                        isDragging={isDragging}
                                        isResizing={isResizing}
                                        isLocked={isLocked}
                                        isCascadeGhost={isCascadeGhost}
                                        isConflicting={isConflicting}
                                        isFocused={isFocused}
                                        readOnly={readOnly}
                                        hoveredTask={hoveredTask}
                                        draggingTask={draggingTask}
                                        resizingTask={resizingTask}
                                        isScrollingRef={isScrollingRef}
                                        onMouseDown={onMouseDown}
                                        onResizeStart={onResizeStart}
                                        setHoveredTask={setHoveredTask}
                                        setTooltipPos={setTooltipPos}
                                        setContextMenu={setContextMenu}
                                        onTaskDoubleClick={onTaskDoubleClick}
                                        setModalData={setModalData}
                                    />
                                );
                            })}

                            {/* Current time marker */}
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

                            {/* Accessible table for screen readers — only tasks visible in current viewport */}
                            <foreignObject x={0} y={0} width={1} height={1} aria-hidden="false">
                                <table
                                    // @ts-ignore — xmlns required for HTML inside SVG foreignObject
                                    xmlns="http://www.w3.org/1999/xhtml"
                                    style={{
                                        position: "absolute",
                                        width: "1px",
                                        height: "1px",
                                        overflow: "hidden",
                                        clip: "rect(0 0 0 0)",
                                        whiteSpace: "nowrap",
                                    }}
                                    aria-label="Tareas programadas en el planificador"
                                >
                                    <caption style={{ display: "none" }}>
                                        {`Vista ${viewMode} — ${filteredTasks.length} tarea${filteredTasks.length !== 1 ? "s" : ""}`}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">Orden</th>
                                            <th scope="col">Máquina</th>
                                            <th scope="col">Inicio</th>
                                            <th scope="col">Fin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTasks
                                            .filter((task) => {
                                                if (!task.planned_date || !task.planned_end) return false;
                                                const containerWidth =
                                                    scrollContainerRef.current?.clientWidth ?? totalWidth;
                                                const containerHeight =
                                                    scrollContainerRef.current?.clientHeight ?? totalHeight;
                                                const taskX = timeToX(task.planned_date);
                                                const taskEndX = timeToX(task.planned_end);
                                                const machine = (task as any).is_treatment
                                                    ? "TRATAMIENTO"
                                                    : task.machine || "Sin Máquina";
                                                const taskY = machineYOffsets.get(machine) ?? 0;
                                                const inViewX =
                                                    taskEndX >= scrollPos.x && taskX <= scrollPos.x + containerWidth;
                                                const inViewY =
                                                    taskY + BAR_HEIGHT >= scrollPos.y &&
                                                    taskY <= scrollPos.y + containerHeight;
                                                return inViewX && inViewY;
                                            })
                                            .map((task) => {
                                                const machine = (task as any).is_treatment
                                                    ? "TRATAMIENTO"
                                                    : task.machine || "Sin Máquina";
                                                const orderLabel = task.production_orders?.part_code
                                                    ? `${task.production_orders.part_code}${task.production_orders.part_name ? ` — ${task.production_orders.part_name}` : ""}`
                                                    : String(task.order_id ?? task.id);
                                                return (
                                                    <tr key={task.id}>
                                                        <td>{orderLabel}</td>
                                                        <td>{machine}</td>
                                                        <td>{format(new Date(task.planned_date!), "dd/MM HH:mm")}</td>
                                                        <td>{format(new Date(task.planned_end!), "dd/MM HH:mm")}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </foreignObject>
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Task Modal ────────────────────────────────────────────────── */}
            <TaskModal
                isOpen={!!modalData}
                onClose={() => setModalData(null)}
                initialData={modalData}
                orders={initialOrders}
                operators={operators}
                onSuccess={() => {
                    setModalData(null);
                    window.location.reload();
                }}
                container={container}
            />

            {/* ── Tooltip ───────────────────────────────────────────────────── */}
            <GanttTooltip hoveredTask={hoveredTask} tooltipPos={tooltipPos} getColor={getTaskColor} />

            {/* ── Context Menu ──────────────────────────────────────────────── */}
            <GanttContextMenu
                contextMenu={contextMenu}
                currentTime={currentTime}
                onClose={() => setContextMenu(null)}
                onViewDetails={(task) =>
                    setModalData({
                        id: task.id,
                        machine: task.machine || "Sin Máquina",
                        start: format(new Date(task.planned_date!), "yyyy-MM-dd'T'HH:mm"),
                        end: format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm"),
                        operator: task.operator || "",
                        orderId: task.order_id || "",
                        activeOrder: task.production_orders,
                    })
                }
                onToggleLock={onToggleLock}
            />
        </div>
    );
}
