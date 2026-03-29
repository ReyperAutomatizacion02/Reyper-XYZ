"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DateSelectorProps {
    date: Date | undefined;
    onSelect: (d: Date | undefined) => void;
    /** If omitted, no label is rendered */
    label?: string;
    /** Extra classes applied to the label */
    labelClassName?: string;
    /** Extra classes applied to the trigger button */
    buttonClassName?: string;
    /** Placeholder text shown when no date is selected (default: "Seleccionar") */
    placeholder?: string;
    /** Disables the trigger button */
    disabled?: boolean;
}

export function DateSelector({
    date,
    onSelect,
    label,
    labelClassName,
    buttonClassName,
    placeholder = "Seleccionar",
    disabled,
}: DateSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(date);
    const [panelPos, setPanelPos] = useState<{
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        maxHeight: number;
    }>({ top: 0, left: 0, maxHeight: 320 });

    const buttonRef = useRef<HTMLButtonElement>(null);

    const CALENDAR_WIDTH = 288;
    const CALENDAR_HEIGHT = 320;
    const GAP = 8;

    const computePanelPos = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();

        // Horizontal: align left edge with button, flip to right-align if it overflows
        let left: number | undefined;
        let right: number | undefined;
        if (rect.left + CALENDAR_WIDTH + GAP <= window.innerWidth) {
            left = rect.left;
        } else {
            right = window.innerWidth - rect.right;
        }

        // Vertical: prefer below, flip above when not enough space
        const spaceBelow = window.innerHeight - rect.bottom - GAP;
        const spaceAbove = rect.top - GAP;

        if (spaceBelow >= CALENDAR_HEIGHT || spaceBelow >= spaceAbove) {
            setPanelPos({ top: rect.bottom + GAP, left, right, maxHeight: Math.max(200, spaceBelow) });
        } else {
            setPanelPos({
                bottom: window.innerHeight - rect.top + GAP,
                left,
                right,
                maxHeight: Math.max(200, spaceAbove),
            });
        }
    }, []);

    // Keep panel anchored to button on scroll / resize while open
    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener("scroll", computePanelPos, true);
        window.addEventListener("resize", computePanelPos);
        return () => {
            window.removeEventListener("scroll", computePanelPos, true);
            window.removeEventListener("resize", computePanelPos);
        };
    }, [isOpen, computePanelPos]);

    // Navigate to the selected date's month every time the panel opens
    // (runs after render, so 'date' is always the current prop value)
    useEffect(() => {
        if (isOpen) setCalendarMonth(date);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <div className="space-y-2">
            {label && (
                <Label
                    className={cn("text-xs font-medium uppercase tracking-wider text-muted-foreground", labelClassName)}
                >
                    {label}
                </Label>
            )}
            <Button
                ref={buttonRef}
                type="button"
                variant="outline"
                disabled={disabled}
                className={cn(
                    "w-full justify-start border-border bg-muted/50 text-left font-normal shadow-sm transition-all duration-200 hover:bg-card",
                    !date && "text-muted-foreground",
                    buttonClassName
                )}
                onClick={() => {
                    if (!isOpen) {
                        computePanelPos();
                        setCalendarMonth(date); // navigate to selected date's month on open
                    }
                    setIsOpen(!isOpen);
                }}
            >
                <CalendarIcon className="mr-2 h-4 w-4 text-red-500" />
                {date ? format(date, "PPP", { locale: es }) : <span>{placeholder}</span>}
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Transparent backdrop for click-outside */}
                        <div className="fixed inset-0 z-[9998] bg-transparent" onClick={() => setIsOpen(false)} />

                        {/* Calendar panel — fixed to viewport, never clipped */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -6 }}
                            transition={{ duration: 0.13 }}
                            style={{
                                position: "fixed",
                                top: panelPos.top,
                                bottom: panelPos.bottom,
                                left: panelPos.left,
                                right: panelPos.right,
                                maxHeight: panelPos.maxHeight,
                                zIndex: 9999,
                            }}
                            className="overflow-auto rounded-xl border bg-popover shadow-xl ring-1 ring-border/20"
                        >
                            <Calendar
                                mode="single"
                                selected={date}
                                month={calendarMonth ?? date}
                                onMonthChange={setCalendarMonth}
                                onSelect={(d) => {
                                    onSelect(d);
                                    setIsOpen(false);
                                }}
                                initialFocus
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
