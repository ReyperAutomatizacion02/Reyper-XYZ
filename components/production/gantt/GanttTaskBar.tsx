"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { format, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { Database } from "@/utils/supabase/types";

type Order = Database["public"]["Tables"]["production_orders"]["Row"];
type PlanningTask = Database["public"]["Tables"]["planning"]["Row"] & {
    production_orders: Order | null;
    isDraft?: boolean;
};

export interface GanttTaskBarProps {
    task: PlanningTask;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    isDragging: boolean;
    isResizing: boolean;
    isLocked: boolean;
    isCascadeGhost: boolean;
    isConflicting: boolean;
    isFocused: boolean;
    readOnly: boolean;
    hoveredTask: PlanningTask | null;
    draggingTask: { id: string } | null;
    resizingTask: { id: string } | null;
    isScrollingRef: React.RefObject<boolean>;
    onMouseDown: (e: React.MouseEvent, task: PlanningTask) => void;
    onResizeStart: (e: React.MouseEvent, task: PlanningTask, direction: "left" | "right") => void;
    setHoveredTask: (task: PlanningTask | null) => void;
    setTooltipPos: (pos: { x: number; y: number; mode: "above" | "below" }) => void;
    setContextMenu: (data: { x: number; y: number; task: PlanningTask } | null) => void;
    onTaskDoubleClick?: (task: PlanningTask) => void;
    setModalData: (data: any) => void;
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_THRESHOLD = 400;

export function GanttTaskBar({
    task,
    x,
    y,
    width,
    height,
    color,
    isDragging,
    isResizing,
    isLocked,
    isCascadeGhost,
    isConflicting,
    isFocused,
    readOnly,
    hoveredTask,
    draggingTask,
    resizingTask,
    isScrollingRef,
    onMouseDown,
    onResizeStart,
    setHoveredTask,
    setTooltipPos,
    setContextMenu,
    onTaskDoubleClick,
    setModalData,
}: GanttTaskBarProps) {
    const activeTask = isDragging || isResizing;

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (draggingTask || resizingTask) return;
        if (onTaskDoubleClick) {
            onTaskDoubleClick(task);
        } else {
            setModalData({
                id: task.id,
                machine: task.machine || "Sin Máquina",
                start: format(new Date(task.planned_date!), "yyyy-MM-dd'T'HH:mm"),
                end: format(new Date(task.planned_end!), "yyyy-MM-dd'T'HH:mm"),
                operator: task.operator || "",
                orderId: task.order_id || "",
                activeOrder: task.production_orders,
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (hoveredTask?.id === task.id || !hoveredTask) {
            let tx = e.clientX + 15;
            let ty = e.clientY + 15;
            let mode: "above" | "below" = "below";
            const spaceBelow = window.innerHeight - e.clientY;
            if (tx + TOOLTIP_WIDTH + 20 > window.innerWidth) tx = e.clientX - TOOLTIP_WIDTH - 15;
            if (spaceBelow < TOOLTIP_THRESHOLD) {
                mode = "above";
                ty = spaceBelow + 15;
            }
            setTooltipPos({ x: tx, y: ty, mode });
        }
    };

    return (
        <motion.g
            key={task.id}
            id={task.id}
            initial={{ opacity: 0 }}
            animate={{
                opacity: isCascadeGhost ? 1.0 : activeTask ? 0.9 : 1,
                cursor: isLocked ? "not-allowed" : isDragging ? "grabbing" : "grab",
            }}
            onMouseEnter={() => {
                if (!draggingTask && !resizingTask && !isScrollingRef.current) {
                    setHoveredTask(task);
                }
            }}
            onMouseLeave={() => setHoveredTask(null)}
            onClick={() => {
                if (!readOnly && !draggingTask && !resizingTask) setHoveredTask(task);
            }}
            onMouseMove={handleMouseMove}
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
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                        fill: "#ef4444",
                        transformOrigin: "center",
                        transformBox: "fill-box",
                        filter: "drop-shadow(0 0 8px #ef4444)",
                    }}
                />
            )}

            {/* Focus / active pulse ring */}
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
                        filter: isFocused ? "drop-shadow(0 0 20px #EC1C21)" : "drop-shadow(0 0 15px #fff)",
                    }}
                />
            )}

            {/* Main bar */}
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
                transition={activeTask ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                style={{
                    fill: color,
                    fillOpacity: task.isDraft ? 0.85 : 1,
                    filter: !activeTask ? "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" : undefined,
                    stroke: isLocked
                        ? color
                        : isCascadeGhost
                          ? "#fff"
                          : activeTask
                            ? "white"
                            : task.isDraft
                              ? "white"
                              : "rgba(255,255,255,0.2)",
                    strokeWidth: isLocked ? 2.5 : isCascadeGhost ? 2 : activeTask ? 2 : task.isDraft ? 2 : 1,
                    strokeDasharray: isCascadeGhost ? "4 2" : task.isDraft ? "4 2" : "none",
                    transformOrigin: "center",
                    transformBox: "fill-box",
                }}
            />

            {/* Draft stripe pattern overlay */}
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

            {/* Interaction shield */}
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="rgba(0,0,0,0)"
                className={isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
                onMouseDown={(e) => onMouseDown(e, task)}
                onDoubleClick={handleDoubleClick}
            />

            {/* Label */}
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
                            className={cn("truncate text-[10px] font-black uppercase leading-none")}
                            style={{ textShadow: task.isDraft ? "0 1px 3px rgba(0,0,0,0.5)" : "none" }}
                        >
                            {task.production_orders?.part_code || "S/N"}
                        </div>
                    </div>
                    {width > 100 && (
                        <div className="mt-1 self-start whitespace-nowrap rounded-sm bg-black/10 px-1 py-0.5 text-[8px] font-bold opacity-90">
                            {format(new Date(task.planned_date!), "HH:mm")} –{" "}
                            {format(new Date(task.planned_end!), "HH:mm")}
                        </div>
                    )}
                </div>
            </foreignObject>

            {/* Resize handle — left */}
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

            {/* Resize handle — right */}
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
}
